import { Modal } from "./Modal";
import { Button } from "./Button";

export const ConfirmDialog = ({
  open,
  title = "Confirm",
  message = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal open={open} onClose={onCancel}>
      <div className="p-8">
        <h2 className="text-2xl font-black text-dark">
          {title}
        </h2>

        <p className="mt-3 text-gray-500">
          {message}
        </p>

        <div className="flex justify-end gap-3 mt-8">
          <Button variant="secondary" onClick={onCancel}>
            {cancelText}
          </Button>

          <Button onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
