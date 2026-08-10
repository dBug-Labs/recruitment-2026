"use client";

import { useState } from "react";
import CreateTaskModal from "./CreateTaskModal";

export default function NewTaskButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className="btn grad" onClick={() => setIsOpen(true)}>Create New Task</button>
      {isOpen && <CreateTaskModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
