import { isValidObjectId } from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Activity data is required'), { status: 400 });
  }

  const body = input as Record<string, unknown>;
  const { userId, teamId, type, minutes } = body;
  if (
    typeof userId !== 'string' ||
    !isValidObjectId(userId) ||
    typeof teamId !== 'string' ||
    !isValidObjectId(teamId) ||
    typeof type !== 'string' ||
    !type.trim() ||
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes < 1
  ) {
    throw Object.assign(new Error('Valid userId, teamId, type, and positive minutes are required'), { status: 400 });
  }

  const [user, team] = await Promise.all([User.findById(userId), Team.findById(teamId)]);
  if (!user || !team) {
    throw Object.assign(new Error('User or team not found'), { status: 404 });
  }

  const activity = await Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
  return activity;
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(_input: unknown) {
  if (!_input || typeof _input !== 'object' || Array.isArray(_input)) {
    throw Object.assign(new Error('Team data is required'), { status: 400 });
  }

  const body = _input as Record<string, unknown>;
  const { name, mascot } = body;
  const members = body.members ?? [];
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof mascot !== 'string' ||
    !mascot.trim() ||
    !Array.isArray(members) ||
    !members.every((member) => typeof member === 'string' && isValidObjectId(member))
  ) {
    throw Object.assign(new Error('Valid name, mascot, and member IDs are required'), { status: 400 });
  }

  const memberIds = [...new Set(members as string[])];
  if (memberIds.length > 0) {
    const existingMembers = await User.countDocuments({ _id: { $in: memberIds } });
    if (existingMembers !== memberIds.length) {
      throw Object.assign(new Error('One or more team members were not found'), { status: 404 });
    }
  }

  return Team.create({ name: name.trim(), mascot: mascot.trim(), members: memberIds });
}

export async function getLeaderboard() {
  const [teams, activityTotals] = await Promise.all([
    Team.find().select('name').lean(),
    Activity.aggregate([{ $group: { _id: '$team', totalPoints: { $sum: '$points' } } }]),
  ]);
  const pointsByTeam = new Map(
    activityTotals.map((entry: { _id: { toString(): string }; totalPoints: number }) => [
      entry._id.toString(),
      entry.totalPoints,
    ]),
  );
  const leaderboard = teams
    .map((team) => ({
      teamName: team.name,
      totalPoints: pointsByTeam.get(team._id.toString()) ?? 0,
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints || left.teamName.localeCompare(right.teamName));

  return leaderboard.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const [workouts, recentActivities] = await Promise.all([
    Workout.find().lean(),
    Activity.find({ user: user._id }).sort({ occurredAt: -1 }).limit(10).select('type').lean(),
  ]);
  const activityFocus: Record<string, string> = {
    run: 'endurance',
    cycle: 'endurance',
    walk: 'endurance',
    swim: 'endurance',
    strength: 'strength',
    weights: 'strength',
    yoga: 'mobility',
    stretch: 'mobility',
  };
  const workoutFocus = workouts.map((workout) => workout.focus.toLowerCase());
  const goalFocus = user.fitnessGoal.toLowerCase();
  const recentFocusMatches = recentActivities
    .map((activity) => ({
      activity,
      focus: activityFocus[activity.type.toLowerCase()] ?? activity.type.toLowerCase(),
    }))
    .filter(({ focus }) => workoutFocus.includes(focus));
  const preferredActivity = recentFocusMatches[0];
  const preferredFocus =
    workoutFocus.includes(goalFocus)
      ? goalFocus
      : preferredActivity?.focus;

  const orderedWorkouts = [...workouts].sort((left, right) => {
    const leftMatches = left.focus.toLowerCase() === preferredFocus;
    const rightMatches = right.focus.toLowerCase() === preferredFocus;
    return Number(rightMatches) - Number(leftMatches) || left.title.localeCompare(right.title);
  });

  return orderedWorkouts.map((workout) => ({
    ...workout,
    reason:
      workout.focus.toLowerCase() === goalFocus
        ? `Matches your ${user.fitnessGoal} goal.`
        : workout.focus.toLowerCase() === preferredFocus
          ? `Matches your recent ${preferredActivity?.activity.type ?? 'fitness'} activity.`
          : `Recommended based on your ${user.fitnessGoal} goal and recent activity.`,
  }));
}

export { User };
