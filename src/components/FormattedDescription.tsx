import type { ReactNode } from "react";

function renderFormattedText(value: string) {
  const tokens = value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("*") && token.endsWith("*")) {
      return <em key={index}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}

type FormattedDescriptionProps = {
  value: string;
  className?: string;
};

export default function FormattedDescription({
  value,
  className = "event-preview-descriptionText",
}: FormattedDescriptionProps) {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`bullets-${blocks.length}`}>
        {bullets.map((item, index) => (
          <li key={index}>{renderFormattedText(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((line) => {
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1]);
      return;
    }

    flushBullets();
    blocks.push(
      <p key={`paragraph-${blocks.length}`}>{renderFormattedText(line)}</p>,
    );
  });
  flushBullets();

  return <div className={className}>{blocks}</div>;
}
