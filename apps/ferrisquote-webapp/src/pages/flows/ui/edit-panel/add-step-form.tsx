import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PanelHeader } from "./panel-header"

export function AddStepForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (data: { title: string; description: string }) => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  return (
    <>
      <PanelHeader
        title={t("step_panel.add_title")}
        description={t("step_panel.add_description")}
        onClose={onClose}
      />
      <div className="flex flex-col gap-4 px-5 py-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="step-title">{t("step_panel.title_label")}</Label>
          <Input
            id="step-title"
            placeholder={t("step_panel.title_placeholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="step-desc">{t("step_panel.description_label")}</Label>
          <Textarea
            id="step-desc"
            placeholder={t("step_panel.description_placeholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      </div>
      <div className="flex gap-2 px-5 py-4 border-t shrink-0">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          className="flex-1"
          disabled={!title.trim()}
          onClick={() => {
            onSubmit({ title: title.trim(), description: description.trim() })
            onClose()
          }}
        >
          {t("flow.add_step")}
        </Button>
      </div>
    </>
  )
}
