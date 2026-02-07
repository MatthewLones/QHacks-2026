import { useAppStore } from '../store';
import './EnterLocation.css';

export default function EnterLocation() {
  const location = useAppStore((s) => s.location);

  if (!location) return null;

  return (
    <div className="enter-pill-wrapper">
      <button className="enter-pill" type="button">
        <span className="enter-pill__sparkle" />
        <span className="enter-pill__label">Enter</span>
      </button>
    </div>
  );
}
