import { TextField } from '@mui/material';
import { useEffect } from 'react';

function InputField({
  field,
  labelName,
  formik,
  type = 'text',
  className,
  disabled,
  defaultValue,
}) {
  // Ensure Formik has initial values when component mounts
  useEffect(() => {
    if (defaultValue && !formik.values[field]) {
      formik.setFieldValue(field, defaultValue);
    }
  }, []);
  return (
    <div className={`flex flex-col ${className}`}>
      {labelName && (
        <label htmlFor={field} className="dark:text-zinc-50 mb-1">
          {labelName}
        </label>
      )}
      <TextField
        id={field}
        name={field}
        disabled={disabled}
        variant={disabled ? `outlined` : `outlined`}
        size="small"
        type={type}
        value={formik?.values[field] }
        onChange={formik?.handleChange}
        onBlur={formik?.handleBlur}
        error={formik?.touched[field] && Boolean(formik?.errors[field])}
        helperText={formik?.touched[field] && formik.errors[field]}
        slotProps={{
          htmlInput: {
            className: `${
              disabled
                ? '!bg-zinc-300 dark:!bg-zinc-700 !opacity-90 cursor-not-allowed'
                : ''
            }`,
          },
        }}
        defaultValue={defaultValue}
      />
    </div>
  );
}

export default InputField;
