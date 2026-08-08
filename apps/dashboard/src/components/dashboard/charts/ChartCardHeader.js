import { ArrowUpRight } from "lucide-react";

const toneClasses = {
  brand: "bg-brand-100 text-brand-800",
  gold: "bg-gold-500/15 text-gold-600",
};

export default function ChartCardHeader({ icon: Icon, title, onViewMore, tone = "brand" }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${toneClasses[tone]}`}>
            <Icon className="w-4 h-4" />
          </span>
        )}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {onViewMore && (
        <button
          onClick={onViewMore}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-800 transition-colors"
        >
          View more
          <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
