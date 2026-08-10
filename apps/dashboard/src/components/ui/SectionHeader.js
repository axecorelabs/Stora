const toneClasses = {
  brand: "bg-brand-100 text-brand-800",
  gold: "bg-gold-500/15 text-gold-600",
};

export default function SectionHeader({ icon: Icon, title, tone = "brand", right = null }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
        <span className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${toneClasses[tone]}`}>
          <Icon className="w-4.5 h-4.5" />
        </span>
        {title}
      </h2>
      {right}
    </div>
  );
}
