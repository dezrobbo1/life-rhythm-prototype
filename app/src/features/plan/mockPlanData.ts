export type HiddenEdgeKind =
  | 'prep'
  | 'travel'
  | 'arrival margin'
  | 'setup'
  | 'cleanup'
  | 'transition'
  | 'decompression';

export type PlanItem = {
  id: string;
  title: string;
  area: string;
  type: 'fixed' | 'rhythm';
  softRange: string;
  tone: string;
  suggestedAdjustment: string;
  hiddenEdges?: Array<{
    id: string;
    kind: HiddenEdgeKind;
    label: string;
    range: string;
  }>;
};

export type PlanBlock = {
  id: string;
  label: 'Morning' | 'Midday' | 'Afternoon' | 'Evening' | 'Late evening';
  softTimeRange: string;
  state: 'room' | 'light' | 'full' | 'wind-down';
  summary: string;
  items: PlanItem[];
};

export const planRoomMessage = {
  label: 'Today has room',
  body: 'Fixed commitments are visible. Flexible rhythms can move, shrink, or restart from one action.',
};

export const mockPlanBlocks: PlanBlock[] = [
  {
    id: 'morning',
    label: 'Morning',
    softTimeRange: 'about 6:30-12:00',
    state: 'room',
    summary: 'One fixed point, then a light rhythm.',
    items: [
      {
        id: 'school-dropoff',
        title: 'School drop-off',
        area: 'Family',
        type: 'fixed',
        softRange: 'around 8:15-9:00',
        tone: 'Leave space around the edges.',
        suggestedAdjustment: 'Keep this fixed. Move flexible rhythms around it.',
        hiddenEdges: [
          { id: 'dropoff-prep', kind: 'prep', label: 'Find bags and water bottles', range: '10-15 min' },
          { id: 'dropoff-travel', kind: 'travel', label: 'Drive and park', range: '15-25 min' },
          { id: 'dropoff-arrival', kind: 'arrival margin', label: 'Walk in and settle', range: '5-10 min' },
          { id: 'dropoff-transition', kind: 'transition', label: 'Return and reset attention', range: '5-10 min' },
        ],
      },
      {
        id: 'breakfast-reset',
        title: 'Breakfast reset',
        area: 'Food',
        type: 'rhythm',
        softRange: '5-10 min',
        tone: 'Minimum counts.',
        suggestedAdjustment: 'Shrink to dishes in the sink if the block gets tight.',
        hiddenEdges: [
          { id: 'breakfast-setup', kind: 'setup', label: 'Clear one surface', range: '2-5 min' },
          { id: 'breakfast-cleanup', kind: 'cleanup', label: 'Put away the visible items', range: '3-5 min' },
        ],
      },
    ],
  },
  {
    id: 'midday',
    label: 'Midday',
    softTimeRange: 'about 12:00-3:00',
    state: 'light',
    summary: 'Light block. Keep it simple.',
    items: [
      {
        id: 'admin-check',
        title: 'Admin check',
        area: 'Admin',
        type: 'rhythm',
        softRange: '10-15 min',
        tone: 'One pass is enough.',
        suggestedAdjustment: 'Restart with one message or one form.',
        hiddenEdges: [
          { id: 'admin-prep', kind: 'prep', label: 'Open the right account or note', range: '2-5 min' },
          { id: 'admin-decompression', kind: 'decompression', label: 'Close the loop before switching', range: '5-10 min' },
        ],
      },
    ],
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    softTimeRange: 'about 3:00-6:00',
    state: 'full',
    summary: 'This block may be full. Move or shrink flexible items first.',
    items: [
      {
        id: 'appointment',
        title: 'Health appointment',
        area: 'Health',
        type: 'fixed',
        softRange: 'around 3:30-4:45',
        tone: 'Protect the arrival margin.',
        suggestedAdjustment: 'Keep this fixed and reduce anything flexible nearby.',
        hiddenEdges: [
          { id: 'appointment-prep', kind: 'prep', label: 'Find card, keys, and notes', range: '10-15 min' },
          { id: 'appointment-travel', kind: 'travel', label: 'Travel there and back', range: '30-45 min' },
          { id: 'appointment-arrival', kind: 'arrival margin', label: 'Park, walk in, and check in', range: '10-15 min' },
          { id: 'appointment-decompression', kind: 'decompression', label: 'Low-demand landing after return', range: '10-20 min' },
        ],
      },
      {
        id: 'tidy-kitchen',
        title: 'Tidy kitchen',
        area: 'Home',
        type: 'rhythm',
        softRange: '10-15 min',
        tone: 'Do the visible part.',
        suggestedAdjustment: 'Move later or shrink to the counter only.',
        hiddenEdges: [
          { id: 'kitchen-setup', kind: 'setup', label: 'Gather cloth and bin bag', range: '2-5 min' },
          { id: 'kitchen-cleanup', kind: 'cleanup', label: 'Put supplies away', range: '2-5 min' },
        ],
      },
    ],
  },
  {
    id: 'evening',
    label: 'Evening',
    softTimeRange: 'about 6:00-9:30',
    state: 'wind-down',
    summary: 'Wind-down is protected. No leftover-task pile.',
    items: [
      {
        id: 'review-tomorrow',
        title: "Set tomorrow's first step",
        area: 'Home admin',
        type: 'rhythm',
        softRange: '5-10 min',
        tone: 'A small shutdown is enough.',
        suggestedAdjustment: 'Restart with one action if the evening is already full.',
        hiddenEdges: [
          { id: 'tomorrow-prep', kind: 'prep', label: 'Find the capture place', range: '1-3 min' },
          { id: 'tomorrow-transition', kind: 'transition', label: 'Close today before choosing tomorrow', range: '3-5 min' },
        ],
      },
    ],
  },
  {
    id: 'late-evening',
    label: 'Late evening',
    softTimeRange: 'after 9:30',
    state: 'wind-down',
    summary: 'Optional only. Keep this block low demand.',
    items: [],
  },
];
