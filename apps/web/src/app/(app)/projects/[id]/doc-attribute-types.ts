export type DocAttributeType = "text" | "number" | "select" | "date" | "checkbox";

export type DocAttributeOption = { id: string; name: string; color: string; order: number };

export type DocAttributeDefinition = {
  id: string;
  name: string;
  type: DocAttributeType;
  order: number;
  options: DocAttributeOption[];
};

export const DOC_ATTRIBUTE_TYPES: { value: DocAttributeType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
];
