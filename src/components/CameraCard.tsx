import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function CameraCard({ camera, isAdmin = false }: { camera: any; isAdmin?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{camera.name}</CardTitle>
        <Badge variant={camera.status === "ACTIVE" ? "success" : "destructive"}>
          {camera.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="aspect-video bg-gray-200 rounded-md mb-2 flex items-center justify-center text-gray-400">
          📷 Preview
        </div>
        {isAdmin && <p className="text-xs text-gray-500">Proprietário: {camera.user?.name || "N/A"}</p>}
        <p className="text-xs text-gray-400 truncate">{camera.rtspUrl}</p>
      </CardContent>
    </Card>
  );
}
