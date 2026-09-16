import { useState } from "react";

type TransportProps = { onToggle: () => void; onNext: () => void };

export function Transport({ onToggle, onNext }: TransportProps) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="transport" role="group" aria-label="Playback">
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => {
          setPlaying(!playing);
          onToggle();
        }}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <button type="button" aria-label="Next track" onClick={onNext}>
        ⏭
      </button>
    </div>
  );
}
