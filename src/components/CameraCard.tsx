import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const typeIcons: Record<string, string> = {
  IP: "🌐", USB: "🔌", WIRELESS: "📡", ANALOG: "📺", OTHER: "📹",
};

const typeLabels: Record<string, string> = {
  IP: "IP", USB: "USB", WIRELESS: "Wireless", ANALOG: "Analógica", OTHER: "Outro",
};

export const CameraCard = React.memo(function CameraCard({ camera, isAdmin = false }: { camera: any; isAdmin?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{typeIcons[camera.type] || "📹"}</span>
          <CardTitle className="text-sm font-medium truncate">{camera.name}</CardTitle>
        </div>
        <Badge variant={camera.status === "ACTIVE" ? "success" : "destructive"}>
          {camera.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-md mb-2 flex items-center justify-center text-gray-400 dark:text-gray-500 relative overflow-hidden">
          {camera.streamUrl ? (
            <span className="text-xs text-center px-2">{camera.streamUrl}</span>
          ) : (
            <span className="text-3xl">{typeIcons[camera.type] || "📹"}</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
            {typeLabels[camera.type] || camera.type}
          </span>
          <span className="flex items-center gap-1 ml-2">
            {camera.recordingEnabled && (
              <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                📹 Gravando
              </span>
            )}
            {camera.aiMonitoringEnabled && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                🤖 IA
              </span>
            )}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate ml-2">
            {camera.retentionDays ? `${camera.retentionDays} dias de retenção` : ""}
          </span>
          {isAdmin && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate ml-2">
              {camera.user?.name || "N/A"}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
