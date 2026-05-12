export function Badge({ variant = "default", children }: { variant?: "success" | "destructive" | "default"; children: React.ReactNode }) {
  const colors = {
    success: "bg-green-100 text-green-800",
    destructive: "bg-red-100 text-red-800",
    default: "bg-gray-100 text-gray-800",
  };
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${colors[variant]}`}>
      {children}
    </span>
  );
}
