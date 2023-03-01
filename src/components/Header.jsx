import React from 'react'
import { Link } from 'next'
import MobileMenu from './MobileMenu'

const timeoutLength = 300

class Header extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      active: false,
      mobileActiveClass: '',
      mouseOverButton: '',
      mouseOverMenu: '',
      mouseOverSubButton: '',
      mouseOverSubMenu: '',
    }
  }

  handleMouseHover() {
    this.setState(this.toggleHoverState)
  }

  toggleHamburger = () => {
    this.setState(
      {
        active: !this.state.active,
      },
      () => {
        // set the class for the mobile menu
        this.state.active
          ? this.setState({
              mobileActiveClass: 'navPanel-visible',
            })
          : this.setState({
              mobileActiveClass: '',
            })
      }
    )
  }

  toggleHoverState(state) {
    return {
      isHovering: !state.isHovering,
    }
  }

  enterButton = (name) => {
    return () => {
      this.setState({ mouseOverButton: name })
    }
  }

  leaveButton = () => {
    this.setState({ mouseOverButton: '' })
  }

  enterMenu = (name) => {
    return () => {
      this.setState({ mouseOverMenu: name })
    }
  }

  leaveMenu = () => {
    this.setState({ mouseOverMenu: '' })
  }

  enterSubButton = (name) => {
    return () => {
      this.setState({ mouseOverSubButton: name })
    }
  }

  leaveSubButton = () => {
    setTimeout(() => {
      this.setState({ mouseOverSubButton: '' })
    }, timeoutLength)
  }

  enterSubMenu = (name) => {
    return () => {
      this.setState({ mouseOverSubMenu: name })
    }
  }

  leaveSubMenu = () => {
    setTimeout(() => {
      this.setState({ mouseOverSubMenu: '' })
    }, timeoutLength)
  }

  render() {
    const { siteTitle } = this.props
    const { menuLinks } = this.props
    const open = this.state.mouseOverButton || this.state.mouseOverMenu
    const subOpen = this.state.mouseOverSubButton || this.state.mouseOverSubMenu
    console.log(this.state)
    return (
      <>
        <div className={`navbar-menu ${this.state.mobileActiveClass}`}>
          <div id="titleBar">
            <span className="title">
              <Link to="/">
                <div id="mobile-logo" />
              </Link>
            </span>
            <a
              role="button"
              onClick={() => this.toggleHamburger()}
              className="toggle"
              aria-label="Open mobile menu"
            />
          </div>
          <div id="navPanel">
            <MobileMenu siteTitle={siteTitle} menuLinks={menuLinks} />
          </div>
        </div>

        <header id="header">
          <Link to="/">
            <div id="logo" />
          </Link>
          <div className="navbar-menu">
            <nav>
              <ul style={{ display: 'flex', flex: 1 }}>
                {menuLinks?.map((link) =>
                  link.items ? (
                    <React.Fragment key={link.name}>
                      <li key={link.name} style={{ position: 'relative' }}>
                        <Link
                          onMouseEnter={this.enterButton(link.name)}
                          onMouseLeave={this.leaveButton}
                          className={link.cl}
                          to={link.link}
                        >
                          {link.name}
                        </Link>
                        <ul
                          style={
                            open === link.name
                              ? {
                                  display: `block`,
                                  background: `rgba(39, 40, 51, 0.965)`,
                                  position: `absolute`,
                                  right: `0%`,
                                  minWidth: `150px`,
                                  borderRadius: `5px`,
                                }
                              : { display: `none` }
                          }
                          onMouseEnter={this.enterMenu(link.name)}
                          onMouseLeave={this.leaveMenu}
                        >
                          {link.items.map((sublink) =>
                            sublink.items ? (
                              <React.Fragment key={sublink.name}>
                                <li
                                  key={sublink.name}
                                  style={{
                                    textAlign: `left`,
                                    marginLeft: `0`,
                                    paddingLeft: `0`,
                                    fontSize: `14px`,
                                    display: `block`,
                                    lineHeight: `2.5`,
                                  }}
                                >
                                  <Link
                                    onMouseEnter={this.enterSubButton(sublink.name)}
                                    onMouseLeave={this.leaveSubButton}
                                    to={sublink.link}
                                  >
                                    {sublink.name}
                                  </Link>
                                  <ul
                                    style={
                                      subOpen === sublink.name
                                        ? {
                                            display: `block`,
                                            background: `rgba(39, 40, 51, 0.965)`,
                                            borderRadius: `5px`,
                                            position: `absolute`,
                                            right: `100%`,
                                            width: `100%`,
                                            marginTop: `-35px`,
                                          }
                                        : { display: `none` }
                                    }
                                    onMouseEnter={this.enterSubMenu(sublink.name)}
                                    onMouseLeave={this.leaveSubMenu}
                                  >
                                    {sublink.items.map((nestedsublink) => (
                                      <li
                                        key={nestedsublink.name}
                                        style={{
                                          textAlign: `left`,
                                          marginLeft: `0`,
                                          paddingLeft: `0`,
                                          fontSize: `14px`,
                                          whiteSpace: `nowrap`,
                                          lineHeight: `2.5`,
                                          display: `block`,
                                        }}
                                      >
                                        <Link to={nestedsublink.link}>{nestedsublink.name}</Link>
                                      </li>
                                    ))}
                                  </ul>
                                </li>
                              </React.Fragment>
                            ) : (
                              <li
                                key={sublink.name}
                                style={{
                                  textAlign: `left`,
                                  marginLeft: `0`,
                                  paddingLeft: `0`,
                                  fontSize: `14px`,
                                  lineHeight: `2.5`,
                                  display: `block`,
                                }}
                              >
                                <Link to={sublink.link}>{sublink.name}</Link>
                              </li>
                            )
                          )}
                        </ul>
                      </li>
                    </React.Fragment>
                  ) : (
                    <li key={link.name}>
                      <Link className={link.cl} to={link.link}>
                        {link.name}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </nav>
          </div>
        </header>
      </>
    )
  }
}

export default Header
