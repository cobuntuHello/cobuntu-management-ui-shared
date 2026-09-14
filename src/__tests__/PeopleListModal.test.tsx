import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PeopleListModal, type PeopleListPerson } from "../ui/PeopleListModal";

/**
 * PeopleListModal — the friends list, shared so the admin's copy cannot drift
 * from the community app's.
 *
 * Presentational by design: it takes the people and every string it prints, so
 * neither app's data layer or i18n leaks into the other's.
 */

afterEach(cleanup);

const copy = {
  title: "Friends",
  close: "Close",
  searchPlaceholder: "Search people…",
  emptyTitle: "No friends yet",
  emptySubtitle: "When they connect with people, they show up here.",
  noResultsTitle: "No results",
  noResultsSubtitle: (q: string) => `Nothing matches “${q}”.`,
};

const person = (usertag: string, name: string, img: string | null = null): PeopleListPerson =>
  ({ usertag, name, profileImage: img });

const people = [
  person("ana", "Ana Ferreira"),
  person("sara", "Sara Belo", "https://example.test/sara.jpg"),
  person("subodh", "Subodh Munjal"),
];

describe("PeopleListModal", () => {
  it("lists everyone with their handle", () => {
    render(<PeopleListModal people={people} copy={copy} onClose={() => {}} />);
    expect(screen.getByText("Ana Ferreira")).toBeInTheDocument();
    expect(screen.getByText("@subodh")).toBeInTheDocument();
  });

  it("shows the count beside the title", () => {
    render(<PeopleListModal people={people} copy={copy} onClose={() => {}} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Friends")).toBeInTheDocument();
  });

  it("prefers an explicit count over the page length", () => {
    // The list may be a page of a larger set; the header should say the truth.
    render(<PeopleListModal people={people} count={128} copy={copy} onClose={() => {}} />);
    expect(screen.getByText("128")).toBeInTheDocument();
  });

  it("falls back to initials when someone has no picture", () => {
    // The gap this component exists to close on the admin side: an avatar slot
    // rendering nothing leaves a hole that reads as a broken image.
    render(<PeopleListModal people={[person("ana", "Ana Ferreira")]} copy={copy} onClose={() => {}} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("uses the picture when there is one", () => {
    const { container } = render(
      <PeopleListModal people={[person("sara", "Sara Belo", "https://example.test/s.jpg")]} copy={copy} onClose={() => {}} />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.test/s.jpg");
  });
});

describe("search", () => {
  it("filters by name", () => {
    render(<PeopleListModal people={people} copy={copy} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search people…"), { target: { value: "sara" } });
    expect(screen.getByText("Sara Belo")).toBeInTheDocument();
    expect(screen.queryByText("Ana Ferreira")).not.toBeInTheDocument();
  });

  /**
   * A usertag is stored without its "@" and only displayed with one, so typing
   * the character a reader naturally reaches for used to match nothing and
   * empty the list.
   */
  it("treats '@ana' and 'ana' as the same query", () => {
    render(<PeopleListModal people={people} copy={copy} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search people…"), { target: { value: "@ana" } });
    expect(screen.getByText("Ana Ferreira")).toBeInTheDocument();
  });

  it("says what matched nothing, quoting the query back", () => {
    render(<PeopleListModal people={people} copy={copy} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search people…"), { target: { value: "zzz" } });
    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText(/zzz/)).toBeInTheDocument();
  });

  it("hides the search box when there is nobody to search", () => {
    render(<PeopleListModal people={[]} copy={copy} onClose={() => {}} />);
    expect(screen.queryByPlaceholderText("Search people…")).not.toBeInTheDocument();
    expect(screen.getByText("No friends yet")).toBeInTheDocument();
  });
});

describe("rows link only when the caller says so", () => {
  it("links each row through hrefFor", () => {
    const { container } = render(
      <PeopleListModal people={people} copy={copy} onClose={() => {}} hrefFor={p => `/members/${p.usertag}`} />,
    );
    expect(container.querySelector('a[href="/members/ana"]')).toBeTruthy();
  });

  it("renders plain rows when it does not", () => {
    // The admin may show friends a leader cannot navigate to.
    const { container } = render(<PeopleListModal people={people} copy={copy} onClose={() => {}} />);
    expect(container.querySelector("a")).toBeNull();
  });
});

describe("dismissal", () => {
  it("closes on the X", () => {
    const onClose = vi.fn();
    render(<PeopleListModal people={people} copy={copy} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<PeopleListModal people={people} copy={copy} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on the backdrop but not on the panel", () => {
    const onClose = vi.fn();
    const { container } = render(<PeopleListModal people={people} copy={copy} onClose={onClose} />);
    fireEvent.click(container.querySelector(".plm-panel")!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores page scrolling when it unmounts", () => {
    // It locks body scroll while open; leaving that behind freezes the page.
    const { unmount } = render(<PeopleListModal people={people} copy={copy} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
