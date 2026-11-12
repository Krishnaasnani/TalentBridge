import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Hero from "../../components/home/Hero";
import Features from "../../components/home/Features";
import AISection from "../../components/home/AISection";
import CTA from "../../components/home/CTA";
import Footer from "../../components/common/Footer";

export default function Home() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return undefined;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hash]);

  return (
    <>
      <main className="home-page">
        <Hero />
        <Features />
        <AISection />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
