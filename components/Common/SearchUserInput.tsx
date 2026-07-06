"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchUsers } from "@/actions/payment.actions";

export interface SearchUserResult {
  _id: string;
  pseudo: string;
  telephone: string;
  email?: string;
  photo?: string;
  role: string;
  playerType: string | null;
  level: number | null;
  parties: number | null;
  playerId?: string;
}

interface SearchUserInputProps {
  onSelect: (user: SearchUserResult) => void;
  placeholder?: string;
  label?: string;
}

export default function SearchUserInput({
  onSelect,
  placeholder = "Pseudo, téléphone ou email…",
  label = "Rechercher un joueur",
}: SearchUserInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await searchUsers(query);
      if (res.success && res.users) {
        setResults(res.users as SearchUserResult[]);
        setOpen(res.users.length > 0);
      }
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (user: SearchUserResult) => {
    setOpen(false);
    setQuery(user.pseudo);
    onSelect(user);
  };

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-medium text-black dark:text-white">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-waterloo" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-stroke bg-transparent py-3 pl-10 pr-10 text-sm text-black outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,107,255,0.1)] dark:border-strokedark dark:text-white"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-waterloo" />}
      </div>
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute z-20 mt-1 w-full rounded-xl border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-blacksection"
          >
            {results.map((user) => (
              <button
                key={user._id}
                type="button"
                onClick={() => handleSelect(user)}
                className="flex w-full items-center gap-3 border-b border-stroke px-4 py-3 text-left last:border-0 hover:bg-primary/5 dark:border-strokedark"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-black dark:text-white">{user.pseudo}</p>
                  <p className="truncate text-xs text-waterloo">
                    {user.telephone}
                    {user.email ? ` · ${user.email}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {user.playerType || user.role}
                  </span>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
