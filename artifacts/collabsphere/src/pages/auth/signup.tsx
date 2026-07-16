import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Layers } from "lucide-react";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function Signup() {
  const { signup } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    try {
      await signup(values.name, values.email, values.password);
      toast({ title: "Account created", description: "Welcome to AeroNode!" });
      setLocation("/dashboard");
    } catch (error: any) {
      toast({ 
        title: "Signup Failed", 
        description: error?.message || "Failed to create account", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <Link href="/" className="flex items-center gap-2 mb-8 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center transition-transform group-hover:scale-105">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white group-hover:text-indigo-300 transition-colors">AeroNode</span>
            </Link>
            
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Create an account</h1>
            <p className="text-muted-foreground text-sm">Join the platform to start collaborating</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-white/80">Full Name</Label>
                    <FormControl>
                      <Input 
                        placeholder="Jane Doe" 
                        {...field} 
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-white/80">Email</Label>
                    <FormControl>
                      <Input 
                        placeholder="name@university.edu" 
                        {...field} 
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-white/80">Password</Label>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        {...field} 
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] transition-all"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Creating account..." : "Sign up"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
      
      {/* Decorative Right Panel */}
      <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-indigo-900/20 to-purple-900/20 items-center justify-center border-l border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
        <div className="absolute w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="relative z-10 max-w-md text-center p-8">
          <div className="flex -space-x-4 justify-center mb-8">
            <div className="w-16 h-16 rounded-full border-4 border-[#0a0a0f] bg-indigo-500 flex items-center justify-center text-lg font-bold">A</div>
            <div className="w-16 h-16 rounded-full border-4 border-[#0a0a0f] bg-purple-500 flex items-center justify-center text-lg font-bold">B</div>
            <div className="w-16 h-16 rounded-full border-4 border-[#0a0a0f] bg-pink-500 flex items-center justify-center text-lg font-bold">C</div>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-4">Never work alone.</h2>
          <p className="text-indigo-200/70 leading-relaxed">Live presence, instant sync, and perfect harmony for your next big project deadline.</p>
        </div>
      </div>
    </div>
  );
}
