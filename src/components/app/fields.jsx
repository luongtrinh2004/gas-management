'use client'

import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import CustomTextField from '@core/components/mui/TextField'

export const Text = props => <CustomTextField size='small' fullWidth {...props} />

// Ô nhập tiền: tự phân cách hàng nghìn bằng dấu chấm (UI_RULES 3.1)
export function MoneyField({ value, onChange, unit = 'VNĐ', ...rest }) {
  const display = value === '' || value == null ? '' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
  return (
    <CustomTextField
      size='small'
      fullWidth
      {...rest}
      value={display}
      onChange={e => {
        const raw = e.target.value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
        onChange(raw === '' ? '' : Number(raw))
      }}
      inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
      InputProps={{ endAdornment: unit ? <InputAdornment position='end'>{unit}</InputAdornment> : undefined }}
    />
  )
}

export function SelectField({ options = [], value, onChange, placeholder, allowEmpty = true, ...rest }) {
  return (
    <CustomTextField select size='small' fullWidth value={value ?? ''} onChange={e => onChange(e.target.value)} SelectProps={{ displayEmpty: true }} {...rest}>
      {allowEmpty && (
        <MenuItem value=''>
          <em>{placeholder || '— Chọn —'}</em>
        </MenuItem>
      )}
      {options.map(o => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </CustomTextField>
  )
}

export const DateField = ({ value, onChange, ...rest }) => (
  <CustomTextField size='small' fullWidth type='date' value={value || ''} onChange={e => onChange(e.target.value)} InputLabelProps={{ shrink: true }} {...rest} />
)

export const Check = ({ label, checked, onChange }) => <FormControlLabel control={<Checkbox checked={!!checked} onChange={e => onChange(e.target.checked)} />} label={label} />

export const toOptions = (obj, filter) => Object.entries(obj).filter(([k]) => !filter || filter(k)).map(([value, label]) => ({ value, label }))
