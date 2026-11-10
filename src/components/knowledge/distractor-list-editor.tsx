'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Distractor list editor (issue #46, FR-01). A controlled component that
// manages the list of incorrect options for a regra. The parent owns the
// `string[]` value; this component renders an editable list with add, remove,
// and reorder (up/down) controls. The order is significant — it is the order
// the distractors are stored and (after the seeded shuffle) presented.
interface DistractorListEditorProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function DistractorListEditor({ value, onChange }: DistractorListEditorProps) {
  const t = useTranslations('Knowledge');

  const updateAt = (index: number, text: string): void => {
    const next = value.slice();
    next[index] = text;
    onChange(next);
  };

  const removeAt = (index: number): void => {
    onChange(value.filter((_, i) => i !== index));
  };

  const move = (index: number, delta: number): void => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    const [item] = next.splice(index, 1);
    if (item === undefined) return;
    next.splice(target, 0, item);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.map((distrator, index) => (
        <div key={String(index)} className="flex items-center gap-1.5">
          <input
            type="text"
            value={distrator}
            onChange={(e) => {
              updateAt(index, e.target.value);
            }}
            placeholder={t('distratorPlaceholder', { index: index + 1 })}
            aria-label={t('distratorPlaceholder', { index: index + 1 })}
            className="h-8 flex-1 rounded-md border border-border bg-bg-primary px-2.5 text-sm text-text-primary focus-visible:outline-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              move(index, -1);
            }}
            disabled={index === 0}
            aria-label={t('moveUp')}
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              move(index, 1);
            }}
            disabled={index === value.length - 1}
            aria-label={t('moveDown')}
          >
            <ArrowDown aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              removeAt(index);
            }}
            aria-label={t('removeDistrator', { index: index + 1 })}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          onChange([...value, '']);
        }}
        className="self-start"
      >
        <Plus aria-hidden />
        {t('addDistrator')}
      </Button>
    </div>
  );
}
