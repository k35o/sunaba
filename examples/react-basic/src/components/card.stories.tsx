import type { Meta, StoryObj } from "sunaba/react";
import { Button } from "./button.tsx";

const meta = {
  title: "Components/Card",
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: "24rem",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithCustomRender: Story = {
  args: { heading: "sunaba", body: "An AI-native component workbench." },
  render: (args) => (
    <article>
      <h2 style={{ marginTop: 0 }}>{String(args["heading"])}</h2>
      <p>{String(args["body"])}</p>
      <Button label="Learn more" variant="ghost" />
    </article>
  ),
};

export const Broken: Story = {
  render: () => {
    throw new Error("This story is intentionally broken");
  },
};
