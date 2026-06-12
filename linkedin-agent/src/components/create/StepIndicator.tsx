interface StepIndicatorProps {
  steps: string[];
  current: number;
}

export default function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 ${i <= current ? "text-gray-300" : "text-gray-700"}`}>
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              i < current ? "bg-white border-white text-black" :
              i === current ? "border-gray-400 text-gray-300" :
              "border-[#1e1e1e] text-gray-700"
            }`}>
              {i < current ? "✓" : i + 1}
            </div>
            <span className="text-xs font-medium hidden sm:inline">{label}</span>
          </div>
          {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < current ? "bg-white" : "bg-[#1a1a1a]"}`} />}
        </div>
      ))}
    </div>
  );
}
