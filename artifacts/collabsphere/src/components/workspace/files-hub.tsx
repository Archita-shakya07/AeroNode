import { useRef, useState } from "react";
import {
  FileItem,
  useListFiles,
  useCreateFile,
  useDeleteFile,
  getListFilesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { UploadCloud, FileText, Image as ImageIcon, FileArchive, Trash2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(contentType: string) {
  if (contentType.startsWith("image/")) return ImageIcon;
  if (contentType.includes("zip") || contentType.includes("compressed")) return FileArchive;
  return FileText;
}

export default function FilesHub({ workspaceId, canEdit }: { workspaceId: number; canEdit: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: files = [], isLoading } = useListFiles(workspaceId);
  const createFile = useCreateFile();
  const deleteFile = useDeleteFile();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListFilesQueryKey(workspaceId) });

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await fetch("/api/storage/uploads/local", {
        method: "POST",
        headers: {
          "X-File-Name": file.name,
          "X-File-Content-Type": file.type || "application/octet-stream",
          "X-File-Size": String(file.size),
        },
        body: file,
      });

      if (!response.ok) throw new Error("Upload to storage failed");
      const { objectPath } = await response.json();

      await createFile.mutateAsync({
        id: workspaceId,
        data: {
          fileName: file.name,
          objectPath,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        },
      });

      invalidate();
      toast({ title: "File uploaded", description: file.name });
    } catch (err) {
      toast({ title: "Upload failed", description: "Could not upload this file.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (file: FileItem) => {
    if (!confirm(`Delete "${file.fileName}"?`)) return;
    deleteFile.mutate({ id: file.id }, {
      onSuccess: invalidate,
      onError: () => toast({ title: "Failed to delete file", variant: "destructive" }),
    });
  };

  return (
    <div className="h-full w-full p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Files Hub</h2>
          <p className="text-sm text-muted-foreground">Shared documents, images, and assets for this workspace.</p>
        </div>
        {canEdit && (
          <>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} data-testid="input-file-upload" />
            <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} data-testid="button-upload-file">
              {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
              {isUploading ? "Uploading..." : "Upload File"}
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="glass-surface flex flex-col items-center justify-center text-center py-16 rounded-xl border border-dashed border-border bg-card/50">
          <UploadCloud className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-foreground font-medium">No files yet</p>
          <p className="text-sm text-muted-foreground mt-1">{canEdit ? "Upload the first file to get started." : "Files shared here will appear for everyone."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => {
            const Icon = iconFor(file.contentType);
            return (
              <div key={file.id} className="glass-surface p-4 rounded-xl border border-border bg-card flex flex-col gap-3" data-testid={`card-file-${file.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex gap-1">
                    <a
                      href={`/api/storage${file.objectPath}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Download"
                      data-testid={`link-download-file-${file.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {canEdit && (
                      <button
                        onClick={() => handleDelete(file)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Delete"
                        data-testid={`button-delete-file-${file.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground truncate" title={file.fileName}>{file.fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatSize(file.size)}</p>
                </div>
                <div className="text-xs text-muted-foreground border-t border-border pt-2">
                  {file.uploadedByName} &middot; {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
