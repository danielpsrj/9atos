'use client';

// Demo page for the Shadcn UI primitives (issue #28). Renders each added
// primitive in-theme so the palette can be verified by eye. This is a
// verification surface, not a feature screen.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export default function ComponentsDemoPage() {
  const progress = 64;
  const [zen, setZen] = useState(true);

  return (
    <main className="min-h-screen bg-bg-primary p-8 text-text-primary">
      <h1 className="text-2xl font-semibold text-primary">Shadcn UI primitives — in-theme demo</h1>
      <p className="mt-2 max-w-prose text-base text-text-secondary">
        Every primitive is themed to the Sapphire &amp; Gold Abyss palette (no default Shadcn
        colors).
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Button</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Card</h2>
        <Card className="mt-4 max-w-md">
          <CardHeader>
            <CardTitle>Constitucional — Direitos Fundamentais</CardTitle>
            <CardDescription>Area tag · progress ring demo</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="mb-4" />
            <p className="text-base text-text-secondary">Ring at {progress}%</p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Dialog</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="mt-4">
              Open dialog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New notebook</DialogTitle>
              <DialogDescription>Create a notebook to organize your rules.</DialogDescription>
            </DialogHeader>
            <Button className="mt-4">Create</Button>
          </DialogContent>
        </Dialog>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Tooltip</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" className="mt-4">
              Hover me
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>A sapphire tooltip</p>
          </TooltipContent>
        </Tooltip>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Skeleton</h2>
        <div className="mt-4 flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Select</h2>
        <div className="mt-4 w-[200px]">
          <Select defaultValue="flashcards">
            <SelectTrigger>
              <SelectValue placeholder="Game type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flashcards">Flashcards</SelectItem>
              <SelectItem value="match">Matching</SelectItem>
              <SelectItem value="cloze">Cloze</SelectItem>
              <SelectItem value="multiple-choice">Multiple choice</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Switch</h2>
        <div className="mt-4 flex items-center gap-3">
          <Switch id="zen" checked={zen} onCheckedChange={setZen} />
          <label htmlFor="zen" className="text-base text-text-secondary">
            Zen Mode
          </label>
        </div>
      </section>
    </main>
  );
}
