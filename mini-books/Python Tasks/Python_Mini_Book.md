# Python Mini-Book

## Table of Contents
1.  [Chapter 1: The Basics](#chapter-1-the-basics)
2.  [Chapter 2: Control Flow and Data Structures](#chapter-2-control-flow-and-data-structures)
3.  [Chapter 3: Functions and Error Handling](#chapter-3-functions-and-error-handling)
4.  [Chapter 4: Object-Oriented Programming (OOP)](#chapter-4-object-oriented-programming-oop)
5.  [Chapter 5: Advanced Topics](#chapter-5-advanced-topics)

---

## Chapter 1: The Basics

*   **Code Examples:**

    *   **Variables and Data Types:**
        ```python
        # Strings
        name = "Alice"
        greeting = 'Hello, ' + name
        print(greeting)

        # Numbers
        age = 30
        pi = 3.14
        
        # Boolean
        is_learning = True
        ```
        ![Screenshot of variable declaration](https://i.imgur.com/your-screenshot-1.png)

    *   **Simple Input/Output:**
        ```python
        name = input("What is your name? ")
        print("Hello, " + name + "!")
        ```
        ![Screenshot of input/output](https://i.imgur.com/your-screenshot-2.png)

*   **Mistake and Solution:**
    *   **Mistake:** I tried to add a number to a string without converting it first, which caused a `TypeError`.
      ```python
      # This will cause an error
      # age = 30
      # print("Your age is: " + age) 
      ```
    *   **Solution:** I learned that you need to convert the number to a string using `str()` before you can concatenate it with another string.
      ```python
      age = 30
      print("Your age is: " + str(age))
      ```

---

## Chapter 2: Control Flow and Data Structures

*   **Code Examples:**

    *   **if/else:**
        ```python
        age = 18
        if age >= 18:
            print("You are an adult.")
        else:
            print("You are a minor.")
        ```

    *   **for loop:**
        ```python
        fruits = ["apple", "banana", "cherry"]
        for fruit in fruits:
            print(fruit)
        ```

    *   **while loop:**
        ```python
        count = 0
        while count < 5:
            print(count)
            count += 1
        ```

    *   **Lists:**
        ```python
        my_list = [1, "hello", 3.14]
        my_list.append("world")
        print(my_list)
        ```

    *   **Dictionaries:**
        ```python
        my_dict = {"name": "Alice", "age": 30}
        print(my_dict["name"])
        my_dict["city"] = "New York"
        ```

---

## Chapter 3: Functions and Error Handling

*   **Code Examples:**

    *   **Functions:**
        ```python
        def greet(name):
            """This function greets the person passed in as a parameter."""
            print("Hello, " + name + ". Good morning!")

        greet('Paul')
        ```

    *   **try/except:**
        ```python
        try:
            x = 10 / 0
        except ZeroDivisionError:
            print("You can't divide by zero!")
        ```

    *   **Importing modules:**
        ```python
        import math

        print(math.pi)
        ```

---

## Chapter 4: Object-Oriented Programming (OOP)

*   **Code Examples:**

    *   **Classes and Objects:**
        ```python
        class Dog:
            def __init__(self, name, age):
                self.name = name
                self.age = age

            def bark(self):
                print("Woof!")

        my_dog = Dog("Buddy", 3)
        print(my_dog.name)
        my_dog.bark()
        ```
        ![Screenshot of OOP example](https://i.imgur.com/your-screenshot-3.png)

---

## Chapter 5: Advanced Topics

*   **Code Examples:**

    *   **Nested Data Structures:**
        ```python
        users = {
            "user1": {
                "name": "Alice",
                "email": "alice@example.com"
            },
            "user2": {
                "name": "Bob",
                "email": "bob@example.com"
            }
        }

        print(users["user1"]["name"])
        ```

    *   **Building a CLI tool with argparse:**
        ```python
        import argparse

        parser = argparse.ArgumentParser(description='A simple CLI tool.')
        parser.add_argument('-n', '--name', help='Your name', required=True)
        args = parser.parse_args()

        print(f"Hello, {args.name}!")
        ```
