import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5 text-center">
      <SearchX className="mx-auto size-10 text-muted-foreground" />
      <h1 className="font-heading text-xl font-bold">No encontramos eso</h1>
      <p className="text-sm text-muted-foreground">
        El levantamiento pudo haberse borrado en oficina.
      </p>
      <Link href="/levantamientos" className={cn(buttonVariants(), "w-full")}>
        Ver mis levantamientos
      </Link>
    </main>
  );
}
