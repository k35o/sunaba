import type { Meta, StoryObj } from "sunaba/react";
import { Button } from "./button.tsx";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { label: "Click me" },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Danger: Story = {
  args: { label: "Delete", variant: "danger" },
};

export const Large: Story = {
  args: { label: "Large button", size: "lg" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const WithPlay: Story = {
  args: { label: "Count up" },
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole("button", { name: "Count up" });
    await userEvent.click(button);
    await userEvent.click(button);
    // Throws (fails the play) when the click counter did not update.
    canvas.getByText("Count up (2)");
  },
};
