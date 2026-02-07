import { useAppStore } from '../store';
import './EnterLocation.css';

export default function EnterLocation() {
  const location = useAppStore((s) => s.location);
  const requestConfirm = useAppStore((s) => s.requestConfirmExploration);

  if (!location) return null;

  return (
    <div className="enter-pill-wrapper">
      <button className="enter-pill" type="button" onClick={requestConfirm}>
        <span className="enter-pill__sparkle" />
        <span className="enter-pill__label">Enter</span>
      </button>
    </div>
  );
}
