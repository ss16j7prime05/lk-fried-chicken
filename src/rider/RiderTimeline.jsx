import { Check } from "lucide-react";
import { FLOW_STEPS, flowStepIndex } from "./riderJobFlow";

// Professional status timeline for an accepted job. Reflects the EXISTING order
// status only (no state changes). Completed steps = green, current = primary + pulse,
// pending = gray. Robust half-connector layout (each step centred in its own column).
export const RiderTimeline = ({ status, t }) => {
  const current = flowStepIndex(status);
  const last = FLOW_STEPS.length - 1;

  return (
    <div className="flex" role="list" aria-label={t("ro.jobDetails.title")}>
      {FLOW_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step} className="flex-1 flex flex-col items-center" role="listitem">
            <div className="flex items-center w-full">
              <span className={`h-1 flex-1 rounded-full ${i === 0 ? "bg-transparent" : i <= current ? "bg-primary" : "bg-gray-200"}`} />
              <span
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                  done
                    ? "bg-primary text-white"
                    : active
                    ? "bg-primary text-white ring-4 ring-primary-light animate-pulse"
                    : "bg-gray-100 text-gray-400"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check size={16} /> : i + 1}
              </span>
              <span className={`h-1 flex-1 rounded-full ${i === last ? "bg-transparent" : i < current ? "bg-primary" : "bg-gray-200"}`} />
            </div>
            <span className={`mt-2 text-[11px] font-bold text-center leading-tight ${active ? "text-primary" : done ? "text-gray-600" : "text-gray-400"}`}>
              {t(`ro.step.${step}`)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
