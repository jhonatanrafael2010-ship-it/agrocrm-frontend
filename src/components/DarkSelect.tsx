import React from "react";
import { TextField, MenuItem } from "@mui/material";

type Option = { value: string | number; label: string };

type Props = {
  name?: string;
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (e: { target: { name?: string; value: string } }) => void;
};

const DarkSelect: React.FC<Props> = ({ name, value, options, placeholder, onChange }) => {
  return (
    <TextField
      select
      fullWidth
      size="small"
      name={name}
      value={value}
      onChange={(e) => onChange({ target: { name, value: e.target.value } })}
      placeholder={placeholder}
      sx={{
        "& .MuiOutlinedInput-root": {
          borderRadius: 2,
        },
      }}
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={String(o.value)}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
};

export default DarkSelect;
