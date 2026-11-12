import { CapabilityCard } from './CapabilityCard.js';
export default function Workouts() {
  const email = encodeURIComponent('mona@example.com');
  return <CapabilityCard title="Workout suggestions" description="Recommend workouts from activity patterns." endpoint={`/api/workouts/suggestions/${email}`} dataKey="suggestions" emptyMessage="No workout suggestions yet." />;
}
