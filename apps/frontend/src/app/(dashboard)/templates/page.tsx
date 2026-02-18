"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Template } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Users, Shield, Lock, Key, Laptop, Wand2 } from "lucide-react";
import { toast } from "sonner";

const ICON_MAP: Record<string, React.ElementType> = {
  users: Users,
  shield: Shield,
  lock: Lock,
  key: Key,
  laptop: Laptop,
};

function TemplateCard({
  template,
  onUse,
}: {
  template: Template;
  onUse: (t: Template) => void;
}) {
  const Icon = ICON_MAP[template.icon_key] || Shield;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent shrink-0">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{template.name}</CardTitle>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="secondary">{template.product_tag}</Badge>
              <Badge variant="outline" className="text-xs font-mono">
                {template.resource_type}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-4">
        <CardDescription className="text-sm">{template.description}</CardDescription>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Runs every {template.default_schedule_hours}h
          </span>
          <Button size="sm" onClick={() => onUse(template)}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            Use Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [monitorName, setMonitorName] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: api.getTemplates,
  });

  const seedMutation = useMutation({
    mutationFn: api.seedTemplates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Templates seeded successfully");
    },
    onError: (err) => toast.error(`Seed failed: ${err.message}`),
  });

  const createMutation = useMutation({
    mutationFn: api.createMonitor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      toast.success("Monitor created successfully");
      setCreateOpen(false);
      setSelectedTemplate(null);
      setMonitorName("");
    },
    onError: (err) => toast.error(`Create failed: ${err.message}`),
  });

  const filtered = templates?.filter(
    (t) => filter === "all" || t.product_tag === filter
  );

  const handleUse = (template: Template) => {
    setSelectedTemplate(template);
    setMonitorName(template.name);
    setCreateOpen(true);
  };

  const handleCreate = () => {
    if (!selectedTemplate || !monitorName.trim()) return;
    createMutation.mutate({
      template_id: selectedTemplate.id,
      name: monitorName,
      description: selectedTemplate.description,
      schedule_hours: selectedTemplate.default_schedule_hours,
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Quick Start Templates" description="Pre-configured monitor templates for common resources">
        <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
          {seedMutation.isPending ? "Seeding..." : "Seed Templates"}
        </Button>
      </PageHeader>

      {/* Filter chips */}
      <div className="flex gap-2">
        {["all", "entra", "intune"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Template grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No templates found. Click &quot;Seed Templates&quot; to load defaults.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered?.map((template) => (
            <TemplateCard key={template.id} template={template} onUse={handleUse} />
          ))}
        </div>
      )}

      {/* Create Monitor Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Monitor</DialogTitle>
            <DialogDescription>
              Create a new monitor from the &quot;{selectedTemplate?.name}&quot; template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">Monitor Name</label>
              <input
                className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={monitorName}
                onChange={(e) => setMonitorName(e.target.value)}
                placeholder="Enter monitor name"
              />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Schedule: Every {selectedTemplate?.default_schedule_hours}h</span>
              <span>&middot;</span>
              <span>Severity: {selectedTemplate?.default_severity}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Monitor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
