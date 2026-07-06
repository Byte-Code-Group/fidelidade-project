import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function SuperadminLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Card>
        <div className="divide-y divide-black/5">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardContent key={i} className="flex items-center gap-3 py-3.5">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </CardContent>
          ))}
        </div>
      </Card>
    </div>
  );
}
