"use client";

import React from "react";
import { Check } from "lucide-react";

interface StepperProps {
  currentStep: number;
  steps: Array<{
    id: number;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

export function Stepper({ currentStep, steps }: StepperProps) {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {steps.map((_, index) => {
          if (index === steps.length - 1) return null;
          const isCompleted = index < currentStep - 1;
          const stepWidth = 100 / steps.length;
          const lineStart = (index + 0.5) * stepWidth;
          const lineEnd = (index + 1.5) * stepWidth;
          return (
            <div key={`line-${index}`} className="absolute top-4 h-0.5 bg-gray-200" style={{ left: `${lineStart}%`, width: `${lineEnd - lineStart}%` }}>
              {isCompleted && <div className="h-full bg-black transition-all duration-300" />}
            </div>
          );
        })}

        {steps.map((step, index) => {
          const isActive = index === currentStep - 1;
          const isCompleted = index < currentStep - 1;
          return (
            <div key={step.id} className="flex flex-col items-center relative z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                isActive ? "bg-black text-white" : isCompleted ? "bg-gray-200 text-black" : "bg-gray-200 text-gray-400"
              }`}>
                {isCompleted ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
              </div>
              <h3 className="text-xs font-semibold text-black text-center">{step.title}</h3>
              <p className="text-[10px] text-gray-500 text-center leading-tight max-w-20">{step.subtitle}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
