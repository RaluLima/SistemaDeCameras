export function Badge({ variant = "default", children }: { variant?: "success" | "destructive" | "default"; children: React.ReactNode }) {
  const colors = {
    success: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    destructive: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
    default: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300",
  };
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${colors[variant]}`}>
      {children}
    </span>
  );
}
