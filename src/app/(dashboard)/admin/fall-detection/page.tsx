import { FallDetection } from "@/components/FallDetection";

export const metadata = {
  title: "Detecção de Quedas | Camera Monitor",
};

export default function FallDetectionPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white text-lg">
          ⚠️
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold dark:text-gray-100">Detecção de Quedas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Monitoramento em tempo real com inteligência artificial
          </p>
        </div>
      </div>
      <FallDetection />
    </div>
  );
}
