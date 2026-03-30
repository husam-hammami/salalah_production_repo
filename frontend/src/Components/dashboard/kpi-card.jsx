import { Card, CardContent } from "@/Components/ui/card"

export function KPICard({ title, value, subtitle, icon, variant = "primary" }) {
  return (
    <Card className={`overflow-hidden ${variant === "secondary" ? "bg-secondary/10" : "theme-bg text-white"}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-2 rounded-lg ${variant === "secondary" ? "bg-secondary/20" : "theme-bg-light"}`}>
            {icon}
          </div>
          <span className={`text-sm font-medium ${variant === "secondary" ? "text-muted-foreground" : "text-blue-100"}`}>
            {subtitle}
          </span>
        </div>
        <div>
          <h3 className={`text-2xl font-bold ${variant === "secondary" ? "text-foreground" : ""}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </h3>
          <p className={`text-sm ${variant === "secondary" ? "text-muted-foreground" : "text-blue-100"}`}>
            {title}
          </p>
        </div>
      </CardContent>
    </Card>
  )
} 