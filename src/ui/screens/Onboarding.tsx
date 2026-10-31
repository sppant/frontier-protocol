import { useViewStore } from '@/store/viewStore';
import { Button } from '@/ui/primitives';
import { TUTORIAL_STEPS, markTutorialSeen } from '@/ui/onboarding';
import styles from './Onboarding.module.css';

/** Non-blocking, step-by-step introduction shown over the map in a new match. */
export function Onboarding() {
  const step = useViewStore((s) => s.tutorialStep);
  const setStep = useViewStore((s) => s.setTutorialStep);
  if (step === null) return null;

  const last = step === TUTORIAL_STEPS.length - 1;
  const current = TUTORIAL_STEPS[step];
  if (!current) return null;
  const finish = () => {
    markTutorialSeen();
    setStep(null);
  };

  return (
    <section className={styles.card} role="region" aria-label="Tutorial">
      <p className="label">
        Step {step + 1} of {TUTORIAL_STEPS.length}
      </p>
      <h2 className={styles.title}>{current.title}</h2>
      <p className={styles.body}>{current.body}</p>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={finish}>
          Skip
        </Button>
        <span className={styles.spacer} />
        {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
        <Button variant="primary" onClick={() => (last ? finish() : setStep(step + 1))}>
          {last ? 'Start playing' : 'Next'}
        </Button>
      </div>
    </section>
  );
}
