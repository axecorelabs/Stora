import { ShieldCheck } from "lucide-react";
import StarRating from "../ui/StarRating";

// One quiet, considered line of trust facts directly under the hero --
// replaces the fragments that used to be crammed into the hero's own meta
// row (rating, verified badge, location, delivery all competing with the
// store name for the same fifteen pixels of white text over a photo).
// Single responsive row, same facts, given room to read as a deliberate
// moment instead of a caption.
export default function StoreTrustStrip({ store, theme }) {
  const facts = [];

  if (store.businessVerified) {
    facts.push({
      key: "verified",
      node: (
        <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: theme.accent }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          Verified by Stora
        </span>
      )
    });
  }

  if (store.totalReviews > 0) {
    facts.push({
      key: "rating",
      node: (
        <span className="inline-flex items-center gap-1.5">
          <StarRating rating={store.averageRating} size={13} />
          <span className="tabular-nums">
            {store.averageRating.toFixed(1)} &middot; {store.totalReviews} review{store.totalReviews === 1 ? "" : "s"}
          </span>
        </span>
      )
    });
  }

  if (store.state) {
    facts.push({ key: "location", node: <span>Based in {store.state}</span> });
  }

  facts.push({
    key: "delivery",
    node: (
      <span>
        {store.deliveryStates && store.deliveryStates.length > 0
          ? `Delivers to ${
              store.deliveryStates.length > 3
                ? `${store.deliveryStates.slice(0, 3).join(", ")} +${store.deliveryStates.length - 3} more`
                : store.deliveryStates.join(", ")
            }`
          : "Delivers nationwide"}
      </span>
    )
  });

  return (
    <div className="border-b" style={{ borderColor: theme.border, backgroundColor: theme.tintFaint }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-3">
        <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap text-[13px] text-gray-600 overflow-x-auto scrollbar-hide">
          {facts.map((fact, index) => (
            <span key={fact.key} className="inline-flex items-center gap-3 whitespace-nowrap">
              {index > 0 && <span className="text-gray-300">&middot;</span>}
              {fact.node}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
