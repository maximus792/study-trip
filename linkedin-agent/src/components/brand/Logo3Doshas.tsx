"use client";

interface Logo3DoshasProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export default function Logo3Doshas({ size = 40, className = "", showText = true }: Logo3DoshasProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <circle cx="100" cy="100" r="90" stroke="#D4956B" strokeWidth="3" />
        <circle cx="100" cy="100" r="88" fill="#1C2434" />
        <polygon points="100,26 58,98 142,98" fill="#E8ECF2" />
        <polygon points="58,106 16,178 100,178" fill="#E8ECF2" />
        <polygon points="142,106 100,178 184,178" fill="#E8ECF2" />
        <circle cx="100" cy="128" r="8" fill="#D4956B" />
      </svg>
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight leading-none">
            <span className="text-white">3Dosh</span>
            <span className="text-[#D4956B]">A</span>
            <span className="text-white">S</span>
          </span>
          <span className="text-[10px] font-medium tracking-[0.08em] text-[#4E6282] uppercase mt-0.5">
            AI Content Studio
          </span>
        </div>
      )}
    </div>
  );
}
