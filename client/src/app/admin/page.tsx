"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { apiRequest, loadStoredToken, storeToken } from "@/lib/api";
import styles from "./page.module.css";

type UserRow = {
  id: number;
  username: string;
  email: string;
  role: "resident" | "authority" | "admin";
};

type WardRow = {
  id: number;
  name: string;
  county: string;
  constituency: string | null;
};

type CategoryRow = {
  id: number;
  name: string;
  description: string | null;
};

type AuthorityRow = {
  id: number;
  name: string;
  type: string;
  jurisdiction: string | null;
};

export default function AdminPage() {
  const [token, setToken] = useState(() => loadStoredToken());
  const [message, setMessage] = useState("");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [wards, setWards] = useState<WardRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [authorities, setAuthorities] = useState<AuthorityRow[]>([]);

  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [newWard, setNewWard] = useState({ name: "", county: "", constituency: "" });
  const [newAuthority, setNewAuthority] = useState({ name: "", type: "", jurisdiction: "" });

  const saveToken = () => {
    storeToken(token);
    setMessage("Token saved locally.");
  };

  const loadAll = async () => {
    setMessage("Loading admin data...");

    try {
      const [usersRes, wardsRes, categoriesRes, authoritiesRes] = await Promise.all([
        apiRequest<{ users: UserRow[] }>("/admin/users", { token }),
        apiRequest<{ wards: WardRow[] }>("/admin/wards", { token }),
        apiRequest<{ categories: CategoryRow[] }>("/admin/categories", { token }),
        apiRequest<{ authorities: AuthorityRow[] }>("/admin/authorities", { token }),
      ]);

      setUsers(usersRes.users);
      setWards(wardsRes.wards);
      setCategories(categoriesRes.categories);
      setAuthorities(authoritiesRes.authorities);
      setMessage("Admin data refreshed.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load admin data.";
      setMessage(msg);
    }
  };

  const updateRole = async (userId: number, role: UserRow["role"]) => {
    try {
      await apiRequest(`/admin/users/${userId}`, {
        method: "PATCH",
        token,
        body: { role },
      });
      setMessage(`Updated user #${userId}.`);
      await loadAll();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Role update failed.";
      setMessage(msg);
    }
  };

  const createCategory = async () => {
    if (!newCategory.name.trim()) {
      setMessage("Category name is required.");
      return;
    }

    try {
      await apiRequest("/admin/categories", {
        method: "POST",
        token,
        body: {
          name: newCategory.name,
          description: newCategory.description,
        },
      });
      setNewCategory({ name: "", description: "" });
      setMessage("Category created.");
      await loadAll();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Create category failed.";
      setMessage(msg);
    }
  };

  const createWard = async () => {
    if (!newWard.name.trim() || !newWard.county.trim()) {
      setMessage("Ward name and county are required.");
      return;
    }

    try {
      await apiRequest("/admin/wards", {
        method: "POST",
        token,
        body: {
          name: newWard.name,
          county: newWard.county,
          constituency: newWard.constituency,
        },
      });
      setNewWard({ name: "", county: "", constituency: "" });
      setMessage("Ward created.");
      await loadAll();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Create ward failed.";
      setMessage(msg);
    }
  };

  const createAuthority = async () => {
    if (!newAuthority.name.trim() || !newAuthority.type.trim()) {
      setMessage("Authority name and type are required.");
      return;
    }

    try {
      await apiRequest("/admin/authorities", {
        method: "POST",
        token,
        body: {
          name: newAuthority.name,
          type: newAuthority.type,
          jurisdiction: newAuthority.jurisdiction,
        },
      });
      setNewAuthority({ name: "", type: "", jurisdiction: "" });
      setMessage("Authority created.");
      await loadAll();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Create authority failed.";
      setMessage(msg);
    }
  };

  return (
    <DashboardShell
      title="Admin Panel"
      subtitle="Manage users, categories, wards, and authorities from one command surface."
      token={token}
      onTokenChange={setToken}
      onSaveToken={saveToken}
    >
      <div className={styles.toolbar}>
        <button onClick={loadAll}>Refresh all datasets</button>
        <p>{message}</p>
      </div>

      <section className={styles.section}>
        <h2>Users</h2>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(event) => updateRole(user.id, event.target.value as UserRow["role"])}
                    >
                      <option value="resident">resident</option>
                      <option value="authority">authority</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Categories</h2>
        <div className={styles.createRow}>
          <input
            placeholder="Name"
            value={newCategory.name}
            onChange={(event) => setNewCategory((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            placeholder="Description"
            value={newCategory.description}
            onChange={(event) => setNewCategory((prev) => ({ ...prev, description: event.target.value }))}
          />
          <button onClick={createCategory}>Add category</button>
        </div>
        <ul className={styles.list}>
          {categories.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.description || "No description"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Wards</h2>
        <div className={styles.createRow}>
          <input
            placeholder="Ward name"
            value={newWard.name}
            onChange={(event) => setNewWard((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            placeholder="County"
            value={newWard.county}
            onChange={(event) => setNewWard((prev) => ({ ...prev, county: event.target.value }))}
          />
          <input
            placeholder="Constituency"
            value={newWard.constituency}
            onChange={(event) => setNewWard((prev) => ({ ...prev, constituency: event.target.value }))}
          />
          <button onClick={createWard}>Add ward</button>
        </div>
        <ul className={styles.list}>
          {wards.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>
                {item.county}
                {item.constituency ? ` / ${item.constituency}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Authorities</h2>
        <div className={styles.createRow}>
          <input
            placeholder="Authority name"
            value={newAuthority.name}
            onChange={(event) => setNewAuthority((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            placeholder="Type"
            value={newAuthority.type}
            onChange={(event) => setNewAuthority((prev) => ({ ...prev, type: event.target.value }))}
          />
          <input
            placeholder="Jurisdiction"
            value={newAuthority.jurisdiction}
            onChange={(event) => setNewAuthority((prev) => ({ ...prev, jurisdiction: event.target.value }))}
          />
          <button onClick={createAuthority}>Add authority</button>
        </div>
        <ul className={styles.list}>
          {authorities.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>
                {item.type}
                {item.jurisdiction ? ` / ${item.jurisdiction}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </DashboardShell>
  );
}
