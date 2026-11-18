"use client";

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import useMediaQuery from "@mui/material/useMediaQuery";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import { Text, MoneyField, SelectField, DateField, Check } from "./fields";

// fields: [{ name, label, type: text|number|money|date|select|textarea|check|password, options, required, xs, helper, unit, multiline }]
export default function FormDialog({
  open,
  title,
  fields,
  initial,
  onClose,
  onSubmit,
  submitText = "Lưu thay đổi",
  maxWidth = "sm",
}) {
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down("sm"));
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initial || {});
      setError("");
      setFieldErrors({});
    }
  }, [open, initial]);

  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (fieldErrors[k]) {
      setFieldErrors((s) => {
        const next = { ...s };
        delete next[k];
        return next;
      });
    }
  };

  const submit = async (e) => {
    e?.preventDefault();
    const newFieldErrors = {};
    for (const f of fields) {
      if (f.hidden?.(values)) continue;
      const val = values[f.name];
      if (
        f.required &&
        (val === "" || val == null || (typeof val === "string" && !val.trim()))
      ) {
        const cleanLabel = f.label.replace(/\s*\*$/, "").trim();
        newFieldErrors[f.name] = `Vui lòng nhập ${cleanLabel.toLowerCase()}`;
      }
      if (f.type === "money" && val !== "" && val != null && Number(val) < 0) {
        newFieldErrors[f.name] =
          `${f.label.replace(/\s*\*$/, "").trim()} không được là số âm`;
      }
      if (
        f.type === "number" &&
        val !== "" &&
        val != null &&
        Number(val) < 0 &&
        f.min !== undefined &&
        f.min >= 0
      ) {
        newFieldErrors[f.name] =
          `${f.label.replace(/\s*\*$/, "").trim()} không được là số âm`;
      }
      if (
        f.type === "password" &&
        f.required &&
        val &&
        String(val).length < 8
      ) {
        newFieldErrors[f.name] = "Mật khẩu phải có tối thiểu 8 ký tự";
      }
      if (f.name === "email" && val && typeof val === "string") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val.trim())) {
          newFieldErrors[f.name] =
            "Email không đúng định dạng (VD: example@gmail.com)";
        }
      }
    }
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      const firstField = fields.find((f) => newFieldErrors[f.name]);
      const firstLabel = firstField?.label || Object.keys(newFieldErrors)[0];
      setError(
        `Vui lòng kiểm tra lại: ${firstLabel.replace(/\s*\*$/, "").trim()} (${Object.values(newFieldErrors)[0]})`,
      );
      return;
    }

    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setError(err.message);
      const details =
        err.details ||
        err.raw?.details ||
        (err.raw?.duplicateField
          ? { [err.raw.duplicateField]: err.message }
          : {});
      if (
        details &&
        typeof details === "object" &&
        Object.keys(details).length > 0
      ) {
        setFieldErrors(details);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth={maxWidth}
    >
      <form onSubmit={submit}>
        <DialogTitle variant="h5">{title}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" className="mbe-4">
              {error}
            </Alert>
          )}
          <Grid container spacing={4} className="pbs-2">
            {fields.map((f) => {
              if (f.hidden?.(values)) return null;
              const hasError = Boolean(fieldErrors[f.name]);
              const helper = fieldErrors[f.name] || f.helper;
              const cleanLabel = f.label.replace(/\s*\*$/, "").trim();
              const labelNode = (
                <span>
                  {cleanLabel}
                  {f.required && (
                    <span
                      style={{
                        color: "var(--mui-palette-error-main)",
                        fontWeight: "bold",
                        marginLeft: 4,
                      }}
                    >
                      *
                    </span>
                  )}
                </span>
              );
              const common = {
                label: labelNode,
                error: hasError,
                helperText: helper,
              };
              const v = values[f.name];
              let el;
              switch (f.type) {
                case "money":
                  el = (
                    <MoneyField
                      {...common}
                      unit={f.unit}
                      value={v}
                      onChange={(x) => set(f.name, x)}
                    />
                  );
                  break;
                case "select":
                  el = (
                    <SelectField
                      {...common}
                      options={f.options}
                      value={v}
                      onChange={(x) => set(f.name, x)}
                      allowEmpty={f.allowEmpty !== false}
                    />
                  );
                  break;
                case "multiselect":
                  el = (
                    <Text
                      select
                      {...common}
                      value={v || []}
                      SelectProps={{ multiple: true }}
                      onChange={(e) => set(f.name, e.target.value)}
                    >
                      {f.options.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </Text>
                  );
                  break;
                case "date":
                  el = (
                    <DateField
                      {...common}
                      value={v}
                      onChange={(x) => set(f.name, x)}
                    />
                  );
                  break;
                case "check":
                  el = (
                    <Check
                      label={f.label}
                      checked={v}
                      onChange={(x) => set(f.name, x)}
                    />
                  );
                  break;
                case "textarea":
                  el = (
                    <Text
                      {...common}
                      multiline
                      minRows={3}
                      value={v ?? ""}
                      onChange={(e) => set(f.name, e.target.value)}
                    />
                  );
                  break;
                default:
                  el = (
                    <Text
                      {...common}
                      type={f.type === "number" ? "number" : f.type || "text"}
                      value={v ?? ""}
                      onChange={(e) => set(f.name, e.target.value)}
                    />
                  );
              }
              return (
                <Grid key={f.name} size={{ xs: 12, sm: f.xs || 12 }}>
                  {el}
                </Grid>
              );
            })}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 4, sm: 6 }, pb: 5 }}>
          <Button
            variant="tonal"
            color="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Hủy bỏ
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? "Đang lưu…" : submitText}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
