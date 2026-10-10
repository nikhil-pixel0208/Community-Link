"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/client";
import { TEMPLATES, TEMPLATE_ORDER, type TemplateDef, type TemplateId } from "@/lib/templates";
import type { MemberRole } from "@/lib/types";
import { useToast } from "./toast";
import { Badge, Button, Field, Icon, Modal, Select, TextArea, TextInput } from "./ui";

const ACCENT_RING: Record<string, string> = {
  amber: "hover:border-amber-500/60 hover:bg-amber-500/5",
  emerald: "hover:border-emerald-500/60 hover:bg-emerald-500/5",
  violet: "hover:border-violet-500/60 hover:bg-violet-500/5",
  rose: "hover:border-rose-500/60 hover:bg-rose-500/5",
  sky: "hover:border-sky-500/60 hover:bg-sky-500/5",
  cyan: "hover:border-cyan-500/60 hover:bg-cyan-500/5",
};

const ACCENT_TEXT: Record<string, string> = {
  amber: "text-amber-300",
  emerald: "text-emerald-300",
  violet: "text-violet-300",
  rose: "text-rose-300",
  sky: "text-sky-300",
  cyan: "text-cyan-300",
};

export function Composer({
  open,
  onClose,
  zoneSlug,
  myRole,
  onCreated,
  initialTemplate,
}: {
  open: boolean;
  onClose: () => void;
  zoneSlug: string;
  myRole: MemberRole;
  onCreated: () => void;
  initialTemplate?: TemplateId | null;
}) {
  const [template, setTemplate] = useState<TemplateId | null>(initialTemplate ?? null);

  const reset = () => {
    setTemplate(null);
    onClose();
  };

  const available = useMemo(
    () => TEMPLATE_ORDER.filter((id) => id !== "announcement" || myRole !== "member"),
    [myRole],
  );

  return (
    <Modal
      open={open}
      onClose={reset}
      width="max-w-2xl"
      title={template ? TEMPLATES[template].label : "What do you need?"}
      subtitle={
        template
          ? TEMPLATES[template].vanishRule
          : "Pick a template. Each one knows how to retire itself once it has done its job."
      }
    >
      {!template ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {available.map((id) => {
            const def = TEMPLATES[id];
            return (
              <button
                key={id}
                onClick={() => setTemplate(id)}
                className={`group rounded-xl border hairline bg-ink-900/60 p-3.5 text-left transition ${ACCENT_RING[def.accent]}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg bg-ink-800 ${ACCENT_TEXT[def.accent]}`}>
                    <Icon name={def.icon} className="h-4 w-4" />
                  </span>
                  <span className="text-[14px] font-semibold text-ink-100">{def.label}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">{def.tagline}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <TemplateForm
          def={TEMPLATES[template]}
          zoneSlug={zoneSlug}
          onBack={() => setTemplate(null)}
          onCreated={() => {
            reset();
            onCreated();
          }}
        />
      )}
    </Modal>
  );
}

function TemplateForm({
  def,
  zoneSlug,
  onBack,
  onCreated,
}: {
  def: TemplateDef;
  zoneSlug: string;
  onBack: () => void;
  onCreated: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [ttlMs, setTtlMs] = useState(def.defaultTtlMs);
  const [count, setCount] = useState(def.defaultCount ?? 1);
  const [urgency, setUrgency] = useState("normal");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { ...values };
      for (const f of def.fields) {
        if (f.type === "tags" && values[f.name]) {
          payload[f.name] = values[f.name].split(",").map((s) => s.trim()).filter(Boolean);
        }
        if (f.type === "options") {
          const clean = options.map((o) => o.trim()).filter(Boolean);
          if (clean.length >= 2) payload[f.name] = clean;
          else delete payload[f.name];
        }
      }
      await api(`/api/zones/${zoneSlug}/posts`, {
        method: "POST",
        json: {
          template: def.id,
          payload,
          ttlMs,
          count,
          urgency,
          isAnonymous: anonymous,
        },
      });
      toast({
        tone: "success",
        title: "Posted with a countdown attached",
        detail: def.vanishRule,
      });
      onCreated();
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't post that" });
    } finally {
      setBusy(false);
    }
  };

  const missing = def.fields.some((f) => f.required && !values[f.name]?.trim());

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-400 transition hover:text-ink-200"
      >
        <Icon name="arrowLeft" className="h-3.5 w-3.5" />
        another template
      </button>

      {def.fields.map((f) => {
        if (f.type === "textarea") {
          return (
            <Field key={f.name} label={f.label} help={f.help} required={f.required}>
              <TextArea value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
            </Field>
          );
        }
        if (f.type === "select") {
          return (
            <Field key={f.name} label={f.label} help={f.help} required={f.required}>
              <Select value={values[f.name] ?? f.choices?.[0] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
                {(f.choices ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          );
        }
        if (f.type === "options") {
          return (
            <Field key={f.name} label={f.label} help={f.help}>
              <div className="space-y-2">
                {options.map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <TextInput
                      value={o}
                      placeholder={`Option ${i + 1}`}
                      onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    {options.length > 2 ? (
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                        aria-label="Remove option"
                      >
                        <Icon name="x" className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {options.length < (f.max ?? 5) ? (
                  <Button variant="ghost" size="sm" icon="plus" onClick={() => setOptions((prev) => [...prev, ""])}>
                    Add option
                  </Button>
                ) : null}
              </div>
            </Field>
          );
        }
        return (
          <Field key={f.name} label={f.label} help={f.help} required={f.required}>
            <TextInput
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholder}
            />
          </Field>
        );
      })}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lifetime" help="Hard cap. It can never outlive this.">
          <Select value={String(ttlMs)} onChange={(e) => setTtlMs(Number(e.target.value))}>
            {def.ttlPresets.map((p) => (
              <option key={p.ms} value={p.ms}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>

        {def.countLabel ? (
          <Field label={def.countLabel} help="Hitting this number retires the post.">
            <TextInput
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
        ) : (
          <Field label="Urgency">
            <Select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="high">Time-sensitive</option>
              <option value="critical">Urgent</option>
            </Select>
          </Field>
        )}
      </div>

      {def.countLabel ? (
        <Field label="Urgency">
          <Select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="normal">Normal</option>
            <option value="high">Time-sensitive</option>
            <option value="critical">Urgent</option>
          </Select>
        </Field>
      ) : null}

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border hairline bg-ink-900/60 p-3">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-brand-500)]"
        />
        <span>
          <span className="block text-[13px] font-medium text-ink-100">Post without my name</span>
          <span className="block text-[12px] text-ink-400">
            Moderators can still see who you are. Responders can&apos;t.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-2 rounded-xl border border-brand-500/25 bg-brand-500/8 px-3 py-2.5">
        <Icon name="ghost" className="h-4 w-4 shrink-0 text-brand-400" />
        <p className="text-[12.5px] leading-snug text-ink-200">{def.vanishRule}</p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Badge tone="neutral">
          <Icon name="clock" className="h-3 w-3" />
          {def.ttlPresets.find((p) => p.ms === ttlMs)?.label ?? "custom"}
        </Badge>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button icon="send" onClick={submit} loading={busy} disabled={missing}>
            Post to the zone
          </Button>
        </div>
      </div>
    </div>
  );
}
