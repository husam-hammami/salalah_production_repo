import { useContext } from "react";
import { AuthContext } from "../Context/AuthProvider";

function useLoading() {
  const { authLoading } = useContext(AuthContext);
  return authLoading;
}

export default useLoading;
