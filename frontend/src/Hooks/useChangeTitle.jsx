import { useEffect } from "react";

const useChangeTitle = (newTitle) => {
  useEffect(() => {
    document.title = `${newTitle} | HERCULES-V2`;
  }, [newTitle]);
};

export default useChangeTitle;
