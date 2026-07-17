import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ChatMessage = {
  id: number;
  workspaceId: number;
  userId: number;
  content: string;
  createdAt: string;
  userName: string;
  avatarColor: string;
};

export default function GroupChat({ workspaceId }: { workspaceId: number }) {
  const { user, accessToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");

  const messagesKey = ["messages", workspaceId];

  const {
    data: messages = [],
    isLoading,
    error,
  } = useQuery<ChatMessage[]>({
    queryKey: messagesKey,
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/workspaces/${workspaceId}/messages`, {
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!workspaceId && !!accessToken,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (error) {
      toast({ title: "Could not load chat", variant: "destructive" });
    }
  }, [error, toast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/workspaces/${workspaceId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: messagesKey });
    },
    onError: () => {
      toast({
        title: "Message not sent",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sendMessage.isPending) return;
    sendMessage.mutate(trimmed);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Group Chat</h2>
        <p className="text-sm text-muted-foreground">
          {messages.length} message{messages.length === 1 ? "" : "s"}
        </p>
      </div>

      <ScrollArea className="flex-1 px-6 py-4">
        {isLoading ? (
          <p className="text-muted-foreground">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No messages yet. Start the conversation.
          </p>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isMe = msg.userId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: msg.avatarColor }}
                    title={msg.userName}
                  >
                    {msg.userName.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className={`max-w-[70%] rounded-xl px-4 py-2 text-sm ${
                      isMe
                        ? "bg-indigo-600 text-white"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs font-medium opacity-90">
                        {msg.userName}
                      </span>
                      <span className="text-[10px] opacity-70">
                        {formatDistanceToNow(new Date(msg.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border p-4 flex gap-2"
      >
        <Input
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sendMessage.isPending}
          className="flex-1"
        />
        <Button type="submit" disabled={sendMessage.isPending || !text.trim()}>
          {sendMessage.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  );
}