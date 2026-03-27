import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  FormHelperText,
} from '@mui/material';
import { useEffect } from 'react';

function SelectField({
  field,
  labelName,
  formik,
  options = [],
  className,
  defaultValue,
  isDisabled,
  multiple = false
}) {
  useEffect(() => {
    if (defaultValue && !formik.values[field]) {
      formik.setFieldValue(field, defaultValue);
    } else if (!defaultValue && !formik.values[field]) {
      formik.setFieldValue(field, multiple ? [] : options[0]?.value);
    }
  }, []);

  const handleChange = (event) => {
    if (multiple) {
      const value = event.target.value;
      formik.setFieldValue(field, typeof value === 'string' ? value.split(',') : value);
    } else {
      formik.handleChange(event);
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <FormControl
        variant="outlined"
        className="w-full"
        error={formik?.touched[field] && Boolean(formik?.errors[field])}
      >
        {labelName && (
          <label className="dark:text-zinc-50 mb-1">{labelName}</label>
        )}
        <Select
          defaultValue={defaultValue}
          size="small"
          id={field}
          name={field}
          value={formik?.values[field]}
          onChange={handleChange}
          onBlur={formik?.handleBlur}
          disabled={isDisabled || false}
          multiple={multiple}
        >
          {!multiple && (
            <MenuItem disabled value='' className="!hidden">
              <em>None</em>
            </MenuItem>
          )}
          {options.map((option, index) => (
            <MenuItem key={index} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {formik?.touched[field] && formik?.errors[field] && (
          <FormHelperText>{formik.errors[field]}</FormHelperText>
        )}
      </FormControl>
    </div>
  );
}

export default SelectField;
