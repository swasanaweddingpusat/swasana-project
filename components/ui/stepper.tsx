"use client";

import React from "react";
import { MapPin, Truck, CreditCard, Check } from "lucide-react";

interface StepperProps {
  currentStep: number;
  steps?: Array<{
    id: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }>;
}

const defaultSteps = [
  {
    id: "address",
    title: "Address",
    subtitle: "Add your address here",
    icon: <MapPin className="h-5 w-5" />
  },
  {
    id: "shipping",
    title: "Shipping", 
    subtitle: "Set your preferred shipping method",
    icon: <Truck className="h-5 w-5" />
  },
  {
    id: "payment",
    title: "Payment",
    subtitle: "Add any payment information you have",
    icon: <CreditCard className="h-5 w-5" />
  },
  {
    id: "checkout",
    title: "Checkout",
    subtitle: "Confirm your order",
    icon: <Check className="h-5 w-5" />
  }
];

export function Stepper({ currentStep, steps = defaultSteps }: StepperProps) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        {/* Connecting lines background - only between steps */}
        {steps.map((_, index) => {
          if (index === steps.length - 1) return null;
          
          const isCompleted = index < currentStep - 1;
          const stepWidth = 100 / steps.length;
          const lineStart = (index + 0.5) * stepWidth;
          const lineEnd = (index + 1.5) * stepWidth;
          
          return (
            <div
              key={`line-${index}`}
              className="absolute top-4 h-0.5 bg-gray-200"
              style={{
                left: `${lineStart}%`,
                width: `${lineEnd - lineStart}%`
              }}
            >
              {isCompleted && (
                <div className="h-full bg-black transition-all duration-300" />
              )}
            </div>
          );
        })}

        {steps.map((step, index) => {
          const isActive = index === currentStep - 1;
          const isCompleted = index < currentStep - 1;

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10">
              <div 
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center mb-3 transition-all duration-300
                  ${isActive 
                    ? 'bg-black text-white' 
                    : isCompleted 
                      ? 'bg-gray-200 text-black' 
                      : 'bg-gray-200 text-gray-400'
                  }
                `}
              >
                {isCompleted && !isActive ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.icon
                )}
              </div>
              <h3 className="text-sm font-semibold text-black mb-1 text-center">
                {step.title}
              </h3>
              <p className="text-xs text-gray-500 text-center leading-tight max-w-24">
                {step.subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
