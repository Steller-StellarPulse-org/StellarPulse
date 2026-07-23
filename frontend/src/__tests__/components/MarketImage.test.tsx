import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

// next/image renders a plain <img> in tests, forwarding only DOM-safe props so
// no React "unknown attribute" warnings leak into the console assertions below.
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    onError,
  }: {
    src: string;
    alt: string;
    className?: string;
    onError?: () => void;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={onError} />
  ),
}));

import MarketImage from "@/components/market/MarketImage";

describe("MarketImage", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the labelled placeholder when no src is provided", () => {
    render(<MarketImage alt="Market question" />);

    const placeholder = screen.getByRole("img", { name: "Market question" });
    expect(placeholder).toBeInTheDocument();
    // No real <img> element should be mounted for a missing image
    expect(document.querySelector("img")).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each([["  "], [""], ["not-a-url"], ["data:image/png;base64,xxx"]])(
    "shows the placeholder (no console errors) for the unusable src %j",
    (src) => {
      render(<MarketImage src={src} alt="Broken" />);

      expect(screen.getByRole("img", { name: "Broken" })).toBeInTheDocument();
      expect(document.querySelector("img")).toBeNull();
      expect(errorSpy).not.toHaveBeenCalled();
    }
  );

  it("renders a real image for a valid https src", () => {
    render(
      <MarketImage src="https://cdn.example.com/market.png" alt="Live market" />
    );

    const img = screen.getByRole("img", { name: "Live market" });
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "https://cdn.example.com/market.png");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("renders a real image for a root-relative src", () => {
    render(<MarketImage src="/uploads/market.png" alt="Local market" />);

    const img = screen.getByRole("img", { name: "Local market" });
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "/uploads/market.png");
  });

  it("falls back to the placeholder when the image fails to load", () => {
    render(
      <MarketImage src="https://cdn.example.com/missing.png" alt="Gone" />
    );

    fireEvent.error(screen.getByRole("img", { name: "Gone" }));

    // After onError the <img> is unmounted and the placeholder div is shown
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Gone" })).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("recovers when the src changes after a previous failure (no stale placeholder)", () => {
    const { rerender } = render(
      <MarketImage src="https://cdn.example.com/broken.png" alt="Market" />
    );

    // Break the first image -> placeholder
    fireEvent.error(screen.getByRole("img", { name: "Market" }));
    expect(document.querySelector("img")).toBeNull();

    // A new, valid src on the same instance must show an image again
    rerender(
      <MarketImage src="https://cdn.example.com/fresh.png" alt="Market" />
    );

    const img = screen.getByRole("img", { name: "Market" });
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "https://cdn.example.com/fresh.png");
  });
});
