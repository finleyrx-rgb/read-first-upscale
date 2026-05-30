// Tiny shared store so non-ProjectsBar components (e.g. VisionPanel) know
// which project is currently loaded.

import { create } from "zustand";

type ProjectSession = {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
};

export const useProjectSession = create<ProjectSession>((set) => ({
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
}));
