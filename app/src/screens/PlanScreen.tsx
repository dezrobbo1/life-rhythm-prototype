import { useMemo } from 'react';
import { Card } from '../components';
import { useAppSnapshot } from '../data/AppSnapshotProvider';
import { PlanBlock } from '../features/plan/PlanBlock';
import { mockPlanBlocks, type PlanBlock as PlanBlockData, type PlanItem } from '../features/plan/mockPlanData';
import {
  buildPlanViewModel,
  type AppDataSnapshot,
  type PlanBlockViewModel,
  type PlanItemViewModel,
} from '../viewModels';

function toPlanBlockState(state: PlanBlockViewModel['state']): PlanBlockData['state'] {
  if (state === 'heavy' || state === 'fixed') {
    return 'full';
  }

  if (state === 'wind down') {
    return 'wind-down';
  }

  if (state === 'light' || state === 'free' || state === 'restart point') {
    return 'light';
  }

  return 'room';
}

function toPlanItemData(item: PlanItemViewModel): PlanItem {
  return {
    area: item.area,
    hiddenEdges: item.hiddenEdges,
    id: item.id,
    softRange: item.softRange,
    suggestedAdjustment: (item as PlanItemViewModel & { suggestedAdjustment?: string }).suggestedAdjustment ??
      (item.type === 'fixed'
        ? 'Keep this fixed. Move flexible rhythms around it.'
        : 'Move later, shrink, or restart with one action.'),
    title: item.title,
    tone: item.tone,
    type: item.type,
  };
}

function toPlanBlockData(block: PlanBlockViewModel): PlanBlockData {
  return {
    id: block.id,
    items: [...block.fixedCommitments, ...block.flexibleRhythms].map(toPlanItemData),
    label: block.label,
    softTimeRange: block.softTimeRange,
    state: toPlanBlockState(block.state),
    summary: block.summary,
  };
}

function planScreenSnapshotFromProvider(snapshot: AppDataSnapshot): AppDataSnapshot {
  return {
    ...snapshot,
    planBlocks: mockPlanBlocks.map((block) => ({
      ...block,
      items: block.items.map((item) => ({
        ...item,
        hiddenEdges: item.hiddenEdges ?? [],
      })),
      state: block.state === 'room'
        ? 'planned'
        : block.state === 'full'
          ? 'heavy'
          : block.state === 'wind-down'
            ? 'wind down'
            : 'light',
    })),
  };
}

export function PlanScreen() {
  const { snapshot } = useAppSnapshot();
  const planViewModel = useMemo(
    () => buildPlanViewModel(planScreenSnapshotFromProvider(snapshot)),
    [snapshot],
  );

  return (
    <div className="screen-stack plan-screen">
      <section className="plan-hero" aria-labelledby="plan-title">
        <p className="eyebrow">Soft rhythm scaffold</p>
        <h1 id="plan-title">Plan</h1>
        <p>Plan the shape of your day, not every minute.</p>
      </section>
      <Card>
        <div className="plan-room-message">
          <div>
            <h2>{planViewModel.roomMessage.label}</h2>
            <p>{planViewModel.roomMessage.body}</p>
          </div>
          <span>Power underneath. Calm on the surface.</span>
        </div>
      </Card>
      <div className="plan-blocks" aria-label="Broad day blocks">
        {planViewModel.blocks.map((block) => (
          <PlanBlock block={toPlanBlockData(block)} key={block.id} />
        ))}
      </div>
    </div>
  );
}
