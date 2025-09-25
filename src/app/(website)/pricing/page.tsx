import React from "react";
import { Check, Sparkles, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PricingPage() {
  const plans = [
    {
      name: "Free",
      price: "0",
      description: "Perfect for getting started with personal knowledge management",
      icon: Zap,
      features: [
        "100 saved items per month",
        "Basic AI summaries",
        "Simple chat interface",
        "Web and file upload",
        "Basic search",
        "Community support"
      ],
      popular: false,
      cta: "Get Started"
    },
    {
      name: "Pro",
      price: "12",
      description: "Advanced features for power users and professionals",
      icon: Sparkles,
      features: [
        "Unlimited saved items",
        "Advanced AI analysis",
        "Smart categorization",
        "Custom study plans",
        "Advanced search & filters",
        "Priority support",
        "API access",
        "Team collaboration"
      ],
      popular: true,
      cta: "Start Free Trial"
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "Tailored solutions for organizations and large teams",
      icon: Crown,
      features: [
        "Everything in Pro",
        "Custom integrations",
        "SSO & advanced security",
        "Dedicated account manager",
        "Custom AI models",
        "Advanced analytics",
        "SLA guarantee",
        "On-premise deployment"
      ],
      popular: false,
      cta: "Contact Sales"
    }
  ];

  return (
    <main className="max-w-6xl mx-auto px-6 py-20">
      {/* Hero Section */}
      <div className="text-center mb-20">
        <h1 className="text-3xl font-medium text-foreground mb-6 tracking-tight">
          Simple, Transparent Pricing
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Start free and scale as you grow. No hidden fees, no surprises. 
          Just powerful tools to amplify your thinking.
        </p>
      </div>

      {/* Pricing Cards */}
      <section className="mb-20">
        <div className="grid lg:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const IconComponent = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative bg-card border rounded-lg p-8 ${
                  plan.popular 
                    ? 'border-primary shadow-sm ring-1 ring-primary/20' 
                    : 'border-border'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary/10 rounded-lg p-2">
                    <IconComponent className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-foreground">
                      {plan.price === "Custom" ? "Custom" : `$${plan.price}`}
                    </span>
                    {plan.price !== "Custom" && (
                      <span className="text-xs text-muted-foreground">/month</span>
                    )}
                  </div>
                  {plan.price === "12" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Billed annually ($144/year)
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className={`w-full text-sm ${
                    plan.popular 
                      ? 'bg-primary hover:bg-primary/90' 
                      : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                  }`}
                >
                  {plan.cta}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mb-20">
        <h2 className="text-lg font-medium text-foreground mb-12 text-center">
          Frequently Asked Questions
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Can I change plans anytime?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect 
              immediately, and we&apos;ll prorate any billing differences.
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Is there a free trial for Pro?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Yes, we offer a 14-day free trial for Pro. No credit card required. 
              You can cancel anytime during the trial period.
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-foreground mb-3">
              What happens to my data if I cancel?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your data remains accessible for 30 days after cancellation. 
              You can export everything or reactivate your account during this period.
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Do you offer student discounts?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Yes! Students get 50% off Pro plans with a valid student email. 
              Contact us for verification and discount codes.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="text-center">
        <div className="bg-muted/30 rounded-lg p-8">
          <h2 className="text-lg font-medium text-foreground mb-4">
            Ready to Amplify Your Thinking?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-xl mx-auto">
            Join thousands of learners who&apos;ve transformed their knowledge workflow with Vio.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span>✨ 14-day free trial</span>
            <span>🚀 Setup in minutes</span>
            <span>💰 Cancel anytime</span>
          </div>
        </div>
      </section>
    </main>
  );
} 